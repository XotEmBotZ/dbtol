
const http = require("http");
function queryDockerSocket(path) {
  return new Promise((resolve) => {
    const req = http.request(
      { socketPath: "//./pipe/docker_engine", path, method: "GET", headers: { Host: "localhost" } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
        });
      }
    );
    req.on("error", (err) => resolve({error: err.message}));
    req.end();
  });
}
async function run() {
  const nodes = await queryDockerSocket("/v1.43/nodes");
  console.log("Nodes:", nodes.length || nodes.error);
  const net = await queryDockerSocket("/v1.43/networks/oracle_cluster_net");
  console.log("Net:", net.Containers ? Object.keys(net.Containers).length : net.error);
}
run();

