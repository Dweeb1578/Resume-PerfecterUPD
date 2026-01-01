const fs = require('fs');
const pdf = require('pdf-parse');

console.log("pdf-parse loaded type:", typeof pdf);

async function test() {
    try {
        console.log("Testing PDF parsing...");
        // Create a dummy buffer since we don't have a PDF easily handy, or try to load one if user uploaded?
        // Actually, pdf-parse expects a buffer.
        // I will just check if the require works.

        if (typeof pdf === 'function') {
            console.log("pdf is a function");
        } else if (pdf.default) {
            console.log("pdf has default export");
        } else {
            console.log("pdf is object:", pdf);
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

test();
