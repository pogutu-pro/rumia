import next from "eslint-config-next";

const config = [
  {
    ignores: ["node_modules/**", ".next/**", "pnpm-lock.yaml"],
  },
  ...next,
];

export default config;

