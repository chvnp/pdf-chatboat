import express from 'express';
import multer from 'multer';
import * as PdfJs from 'pdfjs-dist/legacy/build/pdf';
import { Configuration, OpenAIApi } from "openai";
import ExcelJS from 'exceljs';

// Initialize express app
const app = express();
const port = 8000;

app.use(bodyParser.json());
app.use(cors());

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialize OpenAI API
const openai = new OpenAIApi(new Configuration({
  organization: "org-XXXXXXXXXXXXXXXXXXXXXXXXXX",
  apiKey: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
}));

// Function to load PDF pages and return text
async function loadPdfPages(pdfBuffer) {
  // Load and parse the PDF to extract text from each page
  const pdf = await PdfJs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  const pageTexts = [];
  for (let i = 0; i < pdf.numPages; i++) {
    const page = await pdf.getPage(i + 1);
    const textContent = await page.getTextContent();
    const text = textContent.items.map(item => item.str).join(' ');
    pageTexts.push({ pageNumber: i + 1, text });
  }
  return pageTexts;
}

// Function to save embeddings to an Excel file
async function saveEmbeddingsToExcel(embeddings, filename) {
  // Create an Excel file and write embeddings to it
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Embeddings');
  worksheet.columns = embeddings[0].map((_, index) => ({ header: `Dim ${index + 1}`, key: `dim${index + 1}` }));
  embeddings.forEach(embedding => worksheet.addRow(embedding));
  await workbook.xlsx.writeFile(filename);
}

// Function to read embeddings from an Excel file
async function readEmbeddingsFromExcel(filename) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filename);
  const worksheet = workbook.getWorksheet('Embeddings');
  let embeddings = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) { // Assuming first row is headers
      embeddings.push(row.values.slice(1)); // Skip the first empty element
    }
  });
  return embeddings;
}

// Endpoint to handle PDF uploads
app.post('/upload-pdfs', upload.array('pdfs'), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send('No PDF files were uploaded.');
  }

  try {
    const processedFiles = [];

    for (const file of req.files) {
      const pageTexts = await loadPdfPages(file.buffer);

      // Generating embeddings for each page's text
      const embeddings = await Promise.all(pageTexts.map(async (page) => {
        const response = await openai.createEmbedding({ model: "text-embedding-ada-002", input: page.text });
        return response.data.embedding;
      }));

      // Save embeddings to an Excel file
      const excelFilename = `embeddings_${file.originalname}.xlsx`;
      await saveEmbeddingsToExcel(embeddings, excelFilename);

      processedFiles.push({ filename: file.originalname, pageTexts, excelFilename });
    }

    res.status(200).json({ message: 'PDF files processed and embeddings saved successfully', processedFiles });
  } catch (error) {
    res.status(500).send('Error processing PDF files: ' + error.message);
  }
});

// Hypothetical function to find relevant text based on query embeddings
async function findRelevantText(query, embeddings, texts) {

  const hypotheticalAnswer = await generateText(
    openai.ChatTextGenerator({ model: "gpt-3.5-turbo", temperature: 0 }),
    [
      OpenAIChatMessage.system(`Answer the user's question.`),
      OpenAIChatMessage.user(question),
    ]
  );

  const information = await retrieve(
    new VectorIndexRetriever({
      vectorIndex,
      embeddingModel,
      maxResults: 5,
      similarityThreshold: 0.75,
    }),
    hypotheticalAnswer
  );

  return information;
}

app.post('/chat', express.json(), async (req, res) => {
  const { question, excelFilename } = req.body;

  try {
    // Read embeddings and associated texts from the Excel file
    const embeddings = await readEmbeddingsFromExcel(excelFilename);
    const relevantTexts = await findRelevantText(question, embeddings, /* associated texts */);

    // Generate a response using the OpenAI Chat API with relevant texts as context
    const chatResponse = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        ...relevantTexts.map(text => ({ role: "system", content: text })),
        { role: "user", content: question },
      ]
    });

    res.json({ response: chatResponse.data.choices[0].message });
  } catch (error) {
    res.status(500).send('Error in chat generation: ' + error.message);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
