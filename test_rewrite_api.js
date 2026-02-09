const fs = require('fs');

async function testRewrite() {
    const data = JSON.parse(fs.readFileSync('d:\\Projects\\Resume-PerfecterUPD\\test_input.json', 'utf8'));

    try {
        const ports = [3000, 3001];
        for (const port of ports) {
            try {
                console.log(`Trying port ${port}...`);
                const res = await fetch(`http://127.0.0.1:${port}/api/rewrite-rag`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                console.log(`Success on port ${port}`);
                console.log('Status:', res.status);
                const text = await res.text();
                console.log('Body:', text);
                return;
            } catch (e) {
                console.log(`Failed on port ${port}:`, e.message);
            }
        }

        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body:', text);
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

testRewrite();
