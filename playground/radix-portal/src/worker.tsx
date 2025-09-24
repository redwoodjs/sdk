import { defineApp } from "rwsdk/worker";
import { render, route } from "rwsdk/router";

import { Document } from "@/app/Document";
import { Home } from "@/app/pages/Home";
import { setCommonHeaders } from "@/app/headers";
import { DirectReactPortal } from "./app/pages/DirectReactPortal.js";
//import { RadixPortal } from "./app/pages/RadixPortal.js";
//import { Dropdown } from "./app/pages/Dropdown.js";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/direct-react-portal", DirectReactPortal),
    //route("/radix-portal", RadixPortal),
    //route("/dropdown", Dropdown),
  ]),
]);
