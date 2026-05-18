/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SA_JSON_B64: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
