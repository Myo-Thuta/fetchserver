const express = require("express");
const path = require("path");
const cors = require("cors");
const morgan = require("morgan");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const propertiesReader = require("properties-reader");

// Load DB configurations
const propertiesPath = path.resolve(__dirname, "config/db.properties");
const properties = propertiesReader(propertiesPath);
const dbPrefix = properties.get("db.prefix");
const dbUsername = encodeURIComponent(properties.get("db.user"));
const dbPwd = encodeURIComponent(properties.get("db.pwd"));
const dbName = properties.get("db.dbName");
const dbUrl = properties.get("db.dbUrl");
const dbParams = properties.get("db.params");
const uri = dbPrefix + dbUsername + ":" + dbPwd + dbUrl + dbParams;

// Initialize MongoDB Client
let db;
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });
async function connectToDatabase() {
    try {
        await client.connect();
        console.log("Connected to MongoDB Atlas");
        db = client.db(dbName); // Assign global `db`
    } catch (error) {
        console.error("Error connecting to MongoDB Atlas:", error);
    }
}
connectToDatabase(); // Ensure this is called when the app starts

// Initialize Express App
const app = express();
app.set("json spaces", 3);
app.use(cors());
app.use(morgan("short"));
app.use(express.json());
app.use(express.static(path.resolve(__dirname, "images")));

// Middleware to validate collectionName and attach collection
app.param("collectionName", async (req, res, next, collectionName) => {
    try {
        if (!db) throw new Error("Database not initialized");
        req.collection = db.collection(collectionName);
        next();
    } catch (error) {
        next(error);
    }
});

// Routes
app.get("/", (req, res) => {
    res.send("Welcome! Please select a collection, e.g., /collections/lessons");
});

app.get("/collections/:collectionName", async (req, res, next) => {
    try {
        const results = await req.collection.find({}).toArray();
        res.send(results);
    } catch (error) {
        next(error);
    }
});

app.get("/collections/:collectionName/:id", async (req, res, next) => {
    try {
        const result = await req.collection.findOne({ _id: new ObjectId(req.params.id) });
        if (!result) return res.status(404).send({ msg: "Document not found" });
        res.send(result);
    } catch (error) {
        next(error);
    }
});

app.post("/collections/:collectionName", async (req, res, next) => {
    try {
        const result = await req.collection.insertOne(req.body);
        res.send(result);
    } catch (error) {
        next(error);
    }
});

app.delete("/collections/:collectionName/:id", async (req, res, next) => {
    try {
        const result = await req.collection.deleteOne({ _id: new ObjectId(req.params.id) });
        res.send(result.deletedCount === 1 ? { msg: "success" } : { msg: "error" });
    } catch (error) {
        next(error);
    }
});

app.put("/collections/:collectionName/:id", async (req, res, next) => {
    try {
        const result = await req.collection.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: req.body },
            { safe: true, multi: false }
        );
        res.send(result.matchedCount === 1 ? { msg: "success" } : { msg: "error" });
    } catch (error) {
        next(error);
    }
});

app.get("/collections/:collectionName/:max/:sortAspect/:sortAscDesc", async (req, res, next) => {
    // TODO: Validate params
    var max = parseInt(req.params.max, 10); // base 10
    let sortDirection = 1;
    if (req.params.sortAscDesc === "desc") {
        sortDirection = -1;
    }
    req.collection.find({}, {limit: max, sort: [[req.params.sortAspect,sortDirection]]}).toArray(function(err, results) {
        if (err) {
            return next(err);
        }
        res.send(results);
    });
});

app.get("/search", async (req, res) => { 
    try {
        const query = req.query.q || ''; // Get the search query from the request
        const regex = new RegExp(query, 'i'); // Create a case-insensitive regex
        const results = await db.collection('lessons').find({
            $or: [
                {subject: regex},
                {description: regex},
                {location: regex},
                {price: regex},
                {availablespaces: regex}
            ]
        }).toArray();
        res.json(results); // Return the filtered results as JSON
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Error handling middleware
// app.use((err, req, res, next) => {
//     console.error(err);
//     res.status(404).send({ error: err.message || "An error occurred" });
// });

app.use((req, res) => {
    res.status(404).send("Error: Resource not found");
});

// Start Server
const port = process.env.PORT || 3000;
app.listen(port, function() {
    console.log("App started on port: " + port);
});