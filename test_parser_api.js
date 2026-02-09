const fs = require('fs');
const path = require('path');

async function testParser() {
    // Create a dummy PDF file if it doesn't exist
    const pdfPath = path.join(__dirname, 'dummy_test.pdf');
    fs.writeFileSync(pdfPath, 'This is a dummy PDF content for testing.');

    const fileBuffer = fs.readFileSync(pdfPath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', blob, 'dummy_test.pdf');

    const ports = [3000, 3001];

    for (const port of ports) {
        try {
            console.log(`Trying port ${port}...`);
            const res = await fetch(`http://127.0.0.1:${port}/api/parser`, {
                method: 'POST',
                body: formData
            });

            console.log(`Response status: ${res.status}`);
            const text = await res.text();
            console.log('Response body:', text);
            if (res.ok) {
                console.log("Success!");
                return;
            }
        } catch (e) {
            console.log(`Failed on port ${port}:`, e.message);
        }
    }
}

testParser();
