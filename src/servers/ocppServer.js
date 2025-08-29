// Load environment variables first
require('dotenv').config();

const express = require('express');
const expressWs = require('express-ws');
const cors = require('cors');

// load existing controller in the same folder
const ocppController = require('./ocppController');

const app = express();
expressWs(app);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// REST endpoints (mount handlers from controller)
app.post('/ocpp/api/spacepark_cp_api', ocppController.spacepark_cp_api);
app.post('/ocpp/api/ocpp_send_cmd', ocppController.ocpp_send_cmd);
app.get('/ocpp/api/ocpp_test', ocppController.ocpp_test);
app.get('/ocpp/api/see_connections', ocppController.ocpp_see_connections);
app.get('/ocpp/api/ocpp_cpid/:id', ocppController.ocpp_cpid);
app.get('/ocpp/api/ocpp_stop_charging/:cpid', ocppController.ocpp_stop_charging);
app.get('/ocpp/api/ocpp_send_test', ocppController.ocpp_send_test);

// WebSocket route for OCPP clients: /ocpp/:id
app.ws('/ocpp/:id', (ws, req) => {
  const id = req.params.id;
  const remote = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`WS connect: id=${id}, remote=${remote}`);
  // delegate to controller handler which expects (ws, req)
  try {
    ocppController.ocpp_ws(ws, req);
  } catch (e) {
    console.error('ocpp_ws handler error', e);
    ws.close();
  }
});

app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

const port = process.env.PORT || 8089;
app.listen(port, () => {
  console.log(`ocpp service listening on port ${port}`);
});
