const { GoogleGenerativeAI } = require("@google/generative-ai");

require('dotenv').config();
const apiKey = process.env.GEMINI_API_KEY;
console.log("API Key present:", !!apiKey);

const fs = require('fs');

async function testConfig() {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        fs.writeFileSync('debug_log.txt', "Testing Gemini 1.5 Flash...\n");
        const result = await model.generateContent("Hello, are you working?");
        fs.appendFileSync('debug_log.txt', "Response: " + result.response.text() + "\n");
        fs.appendFileSync('debug_log.txt', "SUCCESS: Gemini is reachable!\n");
        console.log("Check debug_log.txt");
    } catch (error) {
        fs.appendFileSync('debug_log.txt', "FAILURE: Gemini Error: " + error.message + "\n");
        if (error.response) fs.appendFileSync('debug_log.txt', JSON.stringify(error.response, null, 2));
        console.error("Check debug_log.txt");
    }
}

testConfig();
