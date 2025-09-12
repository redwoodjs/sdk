"use client";

import "./styles.css";
import logo from "./images/logo.svg?url";
import dot from "./images/dot.png?url";
import dashHorizontal from "./images/dash--horizontal.png?url";
import dashVertical from "./images/dash--vertical.png?url";

import { Icon } from "./components/Icon";

const Start = () => {
  return (
    <div
      className="wrapper"
      // have to define the background here, since I'm importing the images as URL's
      style={{
        backgroundImage: `url(${dashVertical}), url(${dashHorizontal}),
            url(${dashVertical}), url(${dashHorizontal}),
            url(${dashVertical}), url(${dashHorizontal}),
            url(${dashVertical}), url(${dashHorizontal}),
            url(${dot})`,
        backgroundPosition:
          "40px top, left 40px, calc(100% - 40px) top, right 40px, 40px bottom, left calc(100% - 40px), calc(100% - 40px) bottom, right calc(100% - 40px), left top",
        backgroundRepeat:
          "no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, repeat",
      }}
    >
      <div className="container">
        <div className="hello-bar">
          Build Better Together – Help us grow with a tiny click, but huge
          impact.
          <a
            href="https://github.com/redwoodjs/sdk"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon id="github" />
            <span>Star our Repo on GitHub</span>
          </a>
        </div>

        <main>
          <img src={logo} alt="RedwoodSDK" className="logo" />

          <p>
            To get started , edit the files inside the{" "}
            <code>src/app/start</code> directory in your project.
          </p>

          <div className="buttons">
            <a
              href="https://docs.rwsdk.com"
              className="cta__docs"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Read our Docs</span>
            </a>
            <a
              href="https://discord.gg/redwoodjs"
              className="cta__discord"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Join our Discord</span>
              <Icon id="discord" />
            </a>
          </div>
        </main>
        <footer className="footer">
          <ul>
            <li>
              <a
                href="https://learn.rwsdk.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon id="learn" /> Learn
              </a>
            </li>
            <li>
              <a
                href="https://shareware.dev"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon id="install" /> Install Add-Ons
              </a>
            </li>
            <li>
              <a
                href="https://rwsdk.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon id="globe" /> Visit rwsdk.com <Icon id="arrow" />
              </a>
            </li>
          </ul>
        </footer>
      </div>
    </div>
  );
};

export { Start };
