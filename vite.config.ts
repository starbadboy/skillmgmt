import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { scanSkills } from "./server/skillScanner";
import { scanPlugins } from "./server/pluginScanner";
import { scanHooks } from "./server/hookScanner";
import {
  createSkill,
  deleteSkill,
  syncSkill,
  updateSkill,
  type SkillDeletePayload,
  type SkillPayload,
  type SkillSyncPayload,
  type SkillUpdatePayload,
} from "./server/skillStore";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "local-skill-api",
      configureServer(server) {
        server.middlewares.use("/api", skillApiHandler);
      },
      configurePreviewServer(server) {
        server.middlewares.use("/api", skillApiHandler);
      },
    },
  ],
});

async function skillApiHandler(request: any, response: any, next: () => void) {
  const url = new URL(request.url ?? "/", "http://localhost");
  const method = request.method ?? "GET";

  if (
    !url.pathname.startsWith("/skills") &&
    !url.pathname.startsWith("/plugins") &&
    !url.pathname.startsWith("/hooks")
  ) {
    next();
    return;
  }

  try {
    if (method === "GET" && url.pathname === "/hooks") {
      sendJson(response, await scanHooks());
      return;
    }

    if (method === "GET" && url.pathname === "/plugins") {
      sendJson(response, await scanPlugins());
      return;
    }

    if (method === "GET" && url.pathname === "/skills") {
      sendJson(response, await scanSkills());
      return;
    }

    if (method === "POST" && url.pathname === "/skills") {
      sendJson(response, await createSkill(await readJson<SkillPayload>(request)));
      return;
    }

    if (method === "PUT" && url.pathname === "/skills") {
      sendJson(response, await updateSkill(await readJson<SkillUpdatePayload>(request)));
      return;
    }

    if (method === "DELETE" && url.pathname === "/skills") {
      sendJson(response, await deleteSkill(await readJson<SkillDeletePayload>(request)));
      return;
    }

    if (method === "POST" && url.pathname === "/skills/sync") {
      sendJson(response, await syncSkill(await readJson<SkillSyncPayload>(request)));
      return;
    }

    response.statusCode = 404;
    sendJson(response, { error: "Unknown skill API route" });
  } catch (error) {
    response.statusCode = 500;
    sendJson(response, { error: error instanceof Error ? error.message : "Unknown error" });
  }
}

function sendJson(response: any, payload: unknown) {
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

function readJson<T>(request: any): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as T);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}
