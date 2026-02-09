import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { writeFile, readFile, unlink } from 'fs/promises';

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const body = await req.json();

        // Locate python script
        const scriptPath = path.join(process.cwd(), '..', 'rewriter.py');
        const resumeJsonStr = JSON.stringify(body);

        // Create temp output path
        const tempOutputPath = path.join(process.cwd(), `temp_rewrite_${Date.now()}.json`);

        return new Promise<NextResponse>((resolve) => {
            // Pass output path as argument
            const pythonProcess = spawn('python', [scriptPath, tempOutputPath]);

            let errorString = '';

            pythonProcess.stderr.on('data', (data) => {
                errorString += data.toString();
            });

            // Write JSON to stdin and close it
            pythonProcess.stdin.write(resumeJsonStr);
            pythonProcess.stdin.end();

            pythonProcess.on('close', async (code) => {
                // Log stderr for debugging
                if (errorString) {
                    console.log('Python stderr:', errorString);
                }

                if (code !== 0) {
                    console.error('Rewriter script failed with code:', code);
                    console.error('Stderr:', errorString);
                    try { await unlink(tempOutputPath); } catch (e) { }
                    resolve(NextResponse.json(
                        { error: 'Rewriting failed', details: errorString || `Exit code ${code}` },
                        { status: 500 }
                    ));
                    return;
                }

                try {
                    // Check if file exists before reading
                    const { existsSync } = await import('fs');
                    if (!existsSync(tempOutputPath)) {
                        console.error('Output file was not created:', tempOutputPath);
                        resolve(NextResponse.json(
                            { error: 'Rewriter did not produce output', details: errorString },
                            { status: 500 }
                        ));
                        return;
                    }

                    // Read output from file
                    const dataString = await readFile(tempOutputPath, 'utf-8');
                    await unlink(tempOutputPath);

                    if (!dataString.trim()) {
                        console.error('Output file is empty');
                        resolve(NextResponse.json(
                            { error: 'Rewriter produced empty output', details: errorString },
                            { status: 500 }
                        ));
                        return;
                    }

                    const result = JSON.parse(dataString);
                    if (result.error) {
                        resolve(NextResponse.json({ error: result.error, details: result.trace }, { status: 500 }));
                    } else {
                        resolve(NextResponse.json(result, { status: 200 }));
                    }
                } catch (e: any) {
                    console.error('Failed to parse Python output:', e.message);
                    console.error('Stderr was:', errorString);
                    try { await unlink(tempOutputPath); } catch (err) { }
                    resolve(NextResponse.json(
                        { error: 'Invalid response from rewriter', details: e.message },
                        { status: 500 }
                    ));
                }
            });
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
