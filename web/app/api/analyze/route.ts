import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const body = await req.json();

        // Locate python script
        const scriptPath = path.join(process.cwd(), '..', 'analyzer.py');

        // serialize the full resume JSON to pass as arg
        const resumeJsonStr = JSON.stringify(body);

        return new Promise<NextResponse>((resolve) => {
            const pythonProcess = spawn('python', [scriptPath, resumeJsonStr]);

            let dataString = '';
            let errorString = '';

            pythonProcess.stdout.on('data', (data) => {
                dataString += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorString += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error('Analyzer script failed:', errorString);
                    resolve(NextResponse.json(
                        { error: 'Analysis failed', details: errorString },
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
                } catch {
                    console.error('Failed to parse Python output:', dataString);
                    resolve(NextResponse.json(
                        { error: 'Invalid response from analyzer', raw: dataString },
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
