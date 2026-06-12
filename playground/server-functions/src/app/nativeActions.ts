"use server";

export async function nativeUpdateName(name: string) {
  return `Native name updated to: ${name}`;
}

async function nativeDefaultAction() {
  return "Native default action called!";
}

export default nativeDefaultAction;
