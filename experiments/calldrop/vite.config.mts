import { defineConfig } from "vite";
import { redwood } from '@redwoodjs/reloaded/vite'

export default defineConfig({
    plugins: [
        redwood()
    ]
})