import paths from "../helpers/paths";
import fs from "fs";
import mkdirp from "mkdirp";

let logDir = "./logs";
if (process.env.NODE_ENV === "production") {
  logDir = paths.userData + "/logs";
}

export default function logger() {
  mkdirp.sync(logDir);
  const access = fs.createWriteStream(
    `${logDir}/access.${new Date()
      .toLocaleString()
      .split(" ")
      .join("-")
      .split(":")
      .join("-")}.log`,
    { flags: "a" }
  );
  const error = fs.createWriteStream(
    `${logDir}/error.${new Date()
      .toLocaleString()
      .split(" ")
      .join("-")
      .split(":")
      .join("-")}.log`,
    { flags: "a" }
  );

  const fn = process.stdout.write;
  const errFn = process.stderr.write;

  function write() {
    fn.apply(process.stdout, arguments);
    access.write.apply(access, arguments);
  }
  function writeErr() {
    errFn.apply(process.stderr, arguments);
    error.write.apply(error, arguments);
  }

  process.stdout.write = write;
  process.stderr.write = writeErr;
  return Promise.resolve();
}