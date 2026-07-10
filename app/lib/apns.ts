import http2 from "node:http2";
import { createPrivateKey, sign } from "node:crypto";

function normalizePem(key: string): string {
  return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
}

function createApnsJwt(keyId: string, teamId: string, privateKeyPem: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })
  ).toString("base64url");
  const input = `${header}.${payload}`;
  const key = createPrivateKey({ key: normalizePem(privateKeyPem), format: "pem" });
  const signature = sign("sha256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" });
  return `${input}.${signature.toString("base64url")}`;
}

export function isApnsConfigured(): boolean {
  return Boolean(
    process.env.APNS_KEY_ID &&
      process.env.APNS_TEAM_ID &&
      process.env.APNS_KEY
  );
}

export async function sendApnsAlert(
  deviceToken: string,
  title: string,
  body: string
): Promise<{ ok: boolean; status?: number; reason?: string }> {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const apnsKey = process.env.APNS_KEY;
  const bundleId = process.env.APNS_BUNDLE_ID || "com.productefe.decide";

  if (!keyId || !teamId || !apnsKey) {
    return { ok: false, reason: "APNs not configured" };
  }

  const jwt = createApnsJwt(keyId, teamId, apnsKey);
  const host =
    process.env.APNS_USE_SANDBOX === "true"
      ? "api.sandbox.push.apple.com"
      : "api.push.apple.com";

  return new Promise((resolve) => {
    const client = http2.connect(`https://${host}`);

    const fail = (reason: string, status?: number) => {
      client.close();
      resolve({ ok: false, status, reason });
    };

    client.on("error", (err) => fail(err.message));

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
    });

    req.on("response", (headers) => {
      const status = Number(headers[":status"] || 0);
      let responseData = "";
      req.on("data", (chunk) => {
        responseData += chunk;
      });
      req.on("end", () => {
        client.close();
        resolve({
          ok: status === 200,
          status,
          reason: responseData || undefined,
        });
      });
    });

    req.on("error", (err) => fail(err.message));

    req.write(
      JSON.stringify({
        aps: {
          alert: { title, body },
          sound: "default",
        },
      })
    );
    req.end();
  });
}
