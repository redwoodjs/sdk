"use server";

import { serverAction } from "rwsdk/worker";
import { Transform, TransformParam } from "./decorators";

class Greeter {
	@Transform()
	async greet(@TransformParam() name: string) {
		return `Hello, ${name}!`;
	}
}

const greeter = new Greeter();
export const greetUser = serverAction(greeter.greet.bind(greeter));
