import "reflect-metadata";

const PARAM_TRANSFORM_KEY = Symbol("paramTransform");

export const Transform =
	(): MethodDecorator =>
	<T>(
		target: object,
		key: string | symbol,
		descriptor: TypedPropertyDescriptor<T>,
	) => {
		const originalMethod = descriptor.value;

		if (!originalMethod || typeof originalMethod !== "function") {
			throw new Error(`Method ${String(key)} is not a function.`);
		}

		descriptor.value = (async (...args: any[]) => {
			const paramTransforms: number[] =
				Reflect.getMetadata(PARAM_TRANSFORM_KEY, target, key) || [];

			const transformedArgs = args.map((arg, index) => {
				if (paramTransforms.includes(index)) {
					if (typeof arg === "string") {
						return `[Transformed] ${arg.charAt(0).toUpperCase() + arg.slice(1)}`;
					}
					
					return arg;
				}
				
				return arg;
			});

			const originalResult = await originalMethod.call(target, ...transformedArgs);

			return `${originalResult} [Decorated]`;
		}) as T;

		return descriptor;
	};

export const TransformParam = (): ParameterDecorator =>
	(target: object, key: string | symbol | undefined, index: number) => {
		if (key === undefined) return;

		const existingTransforms: number[] =
			Reflect.getMetadata(PARAM_TRANSFORM_KEY, target, key) || [];

		if (!existingTransforms.includes(index)) {
			existingTransforms.push(index);
		}

		Reflect.defineMetadata(PARAM_TRANSFORM_KEY, existingTransforms, target, key);
	};
