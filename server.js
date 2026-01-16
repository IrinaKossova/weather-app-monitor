const express = require("express");
const path = require("path");
const axios = require("axios");
const client = require("prom-client");
const app = express();
const port = 3000;

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDurationMicroseconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});
register.registerMetric(httpRequestDurationMicroseconds);

const apiKeyWeather = "87b31996d9276087e1e5d2d7338ce72c";

app.use(express.static(path.join(__dirname)));

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/weather", async (req, res) => {
  const routeDuration = httpRequestDurationMicroseconds.startTimer();
  const clientAddr = req.ip;

  try {
    const startTime = Date.now();
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=Moscow&appid=${apiKeyWeather}&units=metric&lang=ru`
    );
    const duration = Date.now() - startTime;

    routeDuration({ route: "/weather", status_code: response.status });
    httpRequestDurationMicroseconds.observe(
      { route: "openweathermap_proxy", status_code: 200 },
      duration / 1000
    );

    res.json(response.data);
  } catch (error) {
    const statusCode = error.response ? error.response.status : 500;
    routeDuration({ route: "/weather", status_code: statusCode });
    res.status(statusCode).send({ error: "Weather API error" });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
