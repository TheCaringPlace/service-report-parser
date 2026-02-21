/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "reporting-dashboard",
      home: "aws",
      removal: input?.stage === "production" ? "retain" : "remove",
    };
  },
  async run() {
    const username = new sst.Secret("USERNAME");
    const password = new sst.Secret("PASSWORD");
    const basicAuth = $resolve([username.value, password.value]).apply(
      ([u, p]) => Buffer.from(`${u}:${p}`).toString("base64"),
    );

    const site = new sst.aws.StaticSite("Dashboard", {
      domain: $app.stage === "production" ? "reports.thecaringplace.info" : undefined,
      path: "packages/dashboard",
      build: {
        command: "npm run build",
        output: "dist",
      },
      // Password protect all stages. Set to $app.stage === "production" to only protect prod.
      edge: {
        viewerRequest: {
          injection: $interpolate`
            var auth = "${basicAuth}";
            var authHeader = event.request.headers.authorization;
            if (!authHeader || authHeader.value !== "Basic " + auth) {
              return {
                statusCode: 401,
                statusDescription: "Unauthorized",
                headers: { "www-authenticate": { value: "Basic realm=\"Dashboard\"" } },
              };
            }`,
        },
      },
    });

    return {
      url: site.url,
    };
  },
});
