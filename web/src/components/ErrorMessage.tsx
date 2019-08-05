import React from "react";
import * as queryString from "../lib/queryString";

export default function ErrorMessage(props: { err: any }) {
  const { err } = props;

  let msg;
  if (err instanceof Error) {
    msg = err.message;
    console.log(err);
  } else if (err != null) {
    msg = err.toString();
  } else {
    msg = queryString.parse().error || "Unknown error";
  }

  return (
    <div>
      <p>Error: {msg}</p>
    </div>
  );
}
