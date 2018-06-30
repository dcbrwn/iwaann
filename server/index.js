const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const rollup = require('rollup-endpoint');
const rollupResolve = require('rollup-plugin-node-resolve');
const glob = require('glob-promise');

// SETUP APPLICATION SERVER

const DATASET_ROOT = path.resolve(__dirname + '/../storage/datasets/');

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// SETUP API ENDPOINTS

app.get('/api/v1/dataset/:datasetName', async (req, res) => {
  if (!/[a-z0-9_\- ]+/.test(req.params.datasetName)) {
    return res.status(400).send({
      message: 'Invalid dataset name',
    });
  }

  try {
    const datasetIndexPath = path.join(DATASET_ROOT, req.params.datasetName, 'dataset.json');
    const dataset = JSON.parse(fs.readFileSync(datasetIndexPath).toString());
    const samples = await glob(path.join(DATASET_ROOT, req.params.datasetName) + '/' + dataset.samples);
    dataset.samples = samples.map((sample) => ({
      file: path.relative(path.join(__dirname, '..'), sample),
    }));

    return res.status(200).send(dataset);
  } catch (error) {
    return res.status(500).send(error);
  }

});

// SETUP STATIC ENDPOINTS

app.use('/storage', express.static('storage'));
app.use('/', express.static('assets'));
app.get('/index.js', rollup.serve({
  entry: __dirname + '/../client/index.js',
  plugins: [
    rollupResolve(),
  ],
}));

// LAUNCH THE IWAANN

app.listen(80);
