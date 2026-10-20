// Preloaded into the e2e backend only (node --import). Replaces the Google ID-token check with a fake so tests can
// sign in without talking to Google. Credential format: "e2e-credential:<sub>:<email>". Production code is untouched.
import Module from "node:module";

const load = Module._load;

Module._load = function patched(request, ...rest) {
  if (typeof request === "string" && /google\.verifier$/.test(request)) {
    return {
      verifyGoogleCredential: async (credential) => {
        const m = /^e2e-credential:([^:]+):(.+)$/.exec(credential);
        return m ? { sub: m[1], email: m[2], emailVerified: true, name: m[1] } : null;
      },
    };
  }
  return load.call(this, request, ...rest);
};
