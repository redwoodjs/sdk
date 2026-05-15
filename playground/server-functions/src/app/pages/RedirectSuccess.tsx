import React from "react";

export function RedirectSuccess() {
    return (
        <div style={{ padding: "2rem", border: "2px solid green", borderRadius: "8px", backgroundColor: "#e6fffa" }}>
            <h2 style={{ color: "#2c7a7b" }}>Redirect Successful!</h2>
            <p>You have been redirected to this page from a server function.</p>
            <a href="/" style={{ color: "#319795", textDecoration: "underline" }}>Go back home</a>
        </div>
    );
}
