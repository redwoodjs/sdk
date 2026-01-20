import { expect, it, describe, beforeEach } from "vitest";
import { invoke } from "../helpers";
import { 
    getServerCounter, 
    resetServerCounter 
} from "./action";

describe("RSC Test-Bridge Pattern", () => {
    beforeEach(async () => {
        await invoke("resetServerCounter");
    });

    it("should get the initial server counter", async () => {
        const counter = await invoke<number>("getServerCounter");
        expect(counter).toBe(0);
    });

    it("should change the server counter using FormData", async () => {
        const formData = new FormData();
        formData.append("change", "5");
        
        await invoke("changeServerCounter", formData);
        
        const counter = await invoke<number>("getServerCounter");
        expect(counter).toBe(5);
    });

    it("should handle nested invocations and preserve state", async () => {
        const formData1 = new FormData();
        formData1.append("change", "2");
        await invoke("changeServerCounter", formData1);

        const formData2 = new FormData();
        formData2.append("change", "3");
        await invoke("changeServerCounter", formData2);

        const counter = await invoke<number>("getServerCounter");
        expect(counter).toBe(5);
    });
});
