require('dotenv').config();

const path = require('path');
const express = require('express');
const app = express();

const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

const token = require("./routes/api/token");
app.use("/api/v1/token", token);
app.use('/static', express.static(path.join(__dirname, 'files')))

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server up and running on port ${port} !`));

module.exports=app;
