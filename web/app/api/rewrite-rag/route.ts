import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Use the RAG-enhanced rewriter
        const scriptPath = path.join(process.cwd(), '..', 'rewriter_rag.py');
        const resumeJsonStr = JSON.stringify(body);

        return new Promise((resolve) => {
            // Use stdin to pass JSON to avoid Windows shell escaping issues
            const pythonProcess = spawn('python', [scriptPath]);

            let dataString = '';
            let errorString = '';

            pythonProcess.stdout.on('data', (data) => {
                dataString += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorString += data.toString();
            });

            // Write JSON to stdin and close it
            pythonProcess.stdin.write(resumeJsonStr);
            pythonProcess.stdin.end();

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error('RAG Rewriter script failed:', errorString);
                    resolve(NextResponse.json(
                        { error: 'Rewriting failed', details: errorString },
                        { status: 500 }
                    ));
                    return;
                }

                try {
                    const result = JSON.parse(dataString);
                    if (result.error) {
                        resolve(NextResponse.json({ error: result.error }, { status: 500 }));
                    } else {
                        resolve(NextResponse.json(result, { status: 200 }));
                    }
                } catch (e) {
                    console.error('Failed to parse Python output:', dataString);
                    resolve(NextResponse.json(
                        { error: 'Invalid response from rewriter', raw: dataString },
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
