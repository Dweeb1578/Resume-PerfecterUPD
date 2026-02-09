import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink, readFile } from "fs/promises";
import { join } from "path";
import { spawn } from "child_process";



// Force Rebuild
export const runtime = "nodejs"; // Required for fs/processes

export async function POST(req: NextRequest) {
    let tempFilePath = "";

    try {
        console.log("----- PARSER API (PYTHON BRIDGE) START -----");

        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // 1. Save File Temporarily
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Ensure tmp directory exists
        const tmpDir = join(process.cwd(), "tmp");
        // We'll trust os.tmpdir or create a local tmp
        // Simplest: just save to root or a known temp
        tempFilePath = join(process.cwd(), `temp_${Date.now()}.pdf`);

        await writeFile(tempFilePath, buffer);
        console.log("Saved temp file:", tempFilePath);

        // 2. Spawn Python Script
        // Script is at ../parser.py relative to web/
        const scriptPath = join(process.cwd(), "..", "parser.py");
        console.log("Calling script at:", scriptPath);

        // Create a temp output path
        const tempOutputPath = join(process.cwd(), `temp_out_${Date.now()}.json`);

        return new Promise((resolve) => {
            // Pass tempOutputPath as 2nd argument
            const pythonProcess = spawn("python", [scriptPath, tempFilePath, tempOutputPath]);

            let errorData = "";

            pythonProcess.stderr.on("data", (data) => {
                errorData += data.toString();
            });

            pythonProcess.on("close", async (code) => {
                // Cleanup input temp file
                try { await unlink(tempFilePath); } catch (e) { }

                if (code !== 0) {
                    console.error("Python Script Error:", errorData);
                    // Try to unlink output file just in case
                    try { await unlink(tempOutputPath); } catch (e) { }
                    resolve(NextResponse.json({ error: "Parser script failed", details: errorData }, { status: 500 }));
                    return;
                }

                try {
                    // Read output from file
                    const outputData = await readFile(tempOutputPath, 'utf-8');
                    // Cleanup output file
                    await unlink(tempOutputPath);

                    console.log("Python Output Length:", outputData.length);
                    const json = JSON.parse(outputData);

                    if (json.error) {
                        resolve(NextResponse.json({ error: json.error }, { status: 400 }));
                        return;
                    }

                    // Post-process IDs
                    const addId = (item: any) => ({ ...item, id: item.id || Math.random().toString(36).substr(2, 9) });
                    if (json.experience) json.experience = json.experience.map(addId);
                    if (json.projects) json.projects = json.projects.map(addId);
                    if (json.education) json.education = json.education.map(addId);

                    resolve(NextResponse.json(json));

                } catch (e: any) {
                    console.error("JSON Parse/Read Error:", e);
                    // Try cleanup if read failed
                    try { await unlink(tempOutputPath); } catch (err) { }

                    resolve(NextResponse.json({ error: "Invalid response from parser", details: e.message }, { status: 500 }));
                }
            });
        });

    } catch (error: any) {
        // Cleanup if error occurs before promise
        if (tempFilePath) {
            try { await unlink(tempFilePath); } catch (e) { }
        }

        console.error("----- PARSER API ERROR -----", error);
        return NextResponse.json({
            error: "Failed to parse resume",
            details: error.message
        }, { status: 500 });
    }
}
