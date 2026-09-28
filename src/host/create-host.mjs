import { bootOplStudioHost } from "./dsh/host.mjs";

export async function createOplHostCore(options = {}) {
  return (await bootOplStudioHost(options)).core;
}
