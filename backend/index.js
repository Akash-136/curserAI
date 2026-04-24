import { GoogleGenAI } from "@google/genai";
import readlineSync from "readline-sync";
import "dotenv/config";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const asyncExecute = promisify(exec);
const platform = os.platform();

const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY,
});

async function runCommand({ command }) {
  try {
    const { stdOut, stdErr } = await asyncExecute(command);
    if (stdErr) {
      return `Error: ${stdErr}`;
    }

    return `Success: ${stdOut} || Task Executed`;
  } catch (error) {
    console.log(`Error: ${error}`);
  }
}

const runCommandDeclaration = {
  name: "runCommand",
  description: `Execute a single terminal or shell command. Command can be to create a folder, file, write on the file, edit the file or delete the file`,
  parameters: {
    type: "OBJECT",
    properties: {
      command: {
        type: "STRING",
        description:
          "It will be a single terminal or shell command ex: mkdir calculator",
      },
    },
    required: ["command"],
  },
};

const availableTools = {
  runCommand,
};

const History = [];

async function runAgent(userQuery) {
  History.push({
    role: "user",
    parts: [{ text: userQuery }],
  });

  //     const models = await ai.models.list();

  // for await (const model of models) {
  //   console.log(model.name, model.supportedActions);
  // }
  while (true) {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // add inside your while loop, before generateContent
    await sleep(2000);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: History,
      config: {
        systemInstruction: `you are a website builder expert. You have to create the frontend of the website by analising the user input.
            You have access of the tools which can run or execute any shell or terminal command.
            Current user operating system is ${platform}
            Give command to the user according to its operating system support.
            <-- What is your job -->
            1. Analyse the user query to see what type of website they want to build
            2. Give them command one by one , step by step
            3. Use available tool runCommand

            // Now you can give them command in following order

            1. First create folder  ex: mkdir calculator
            2. Inside the folder create index.html  ex: touch calculator/index.html
            3. Then create style.css same as above 
            4. Then create script.js
            5. Then write a code in html file
            
            you have to provide the terminal/shell command to user, they will directly execute it. 
            `,
        tools: [
          {
            functionDeclarations: [runCommandDeclaration],
          },
        ],
        thinkingConfig: {
          thinkingBudget: 0, // ✅ add this
        },
      },
    });

    if (response.functionCalls && response.functionCalls.length > 0) {
      const { name, args } = response.functionCalls[0];
      console.log(name, args);
      console.log(response.functionCalls[0]);

      const funcall = availableTools[name];
      const result = await funcall(args);
      console.log(result);

      const functionResponsePart = {
        name: name,
        response: {
          result: result,
        },
      };
      console.log(functionResponsePart);

      History.push({
        role: "model",
        parts: response.candidates[0].content.parts, // keeps thought_signature
      });
      History.push({
        role: "user",
        parts: [
          {
            functionResponse: functionResponsePart,
          },
        ],
      });
    } else {
      History.push({
        role: "model",
        parts: [{ text: response.text }],
      });
      console.log(response.text);
      break;
    }
  }
}

async function main() {
  const userQuery = readlineSync.question("Enter query --> ");
  await runAgent(userQuery);
  main();
}

main();
