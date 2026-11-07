module.exports = {
  apps: [
    {
      name: "japanese-lab",
      cwd: __dirname,
      script: "npm",
      args: "start",
      env_production: {
        NODE_ENV: "production",
        PORT: "3005",
        NEXT_PUBLIC_JAPANESE_LAB_BASE_PATH: "/japanese-lab",
      },
    },
  ],
};
