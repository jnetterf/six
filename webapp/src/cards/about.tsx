import React from "react";
import css from "./about.module.scss";

export default function About() {
  return (
    <div className={css.about}>
      <p>
        This is an early version of Six Eight, a lightweight lead sheet (chords
        + melody + lyrics) editor by{" "}
        <a href="https://nettek.ca">Joshua Netterfield</a>. It{" "}
        <b>does not work yet</b>, but you can{" "}
        <a href="https://github.com/jnetterf/six/projects/1">
          track my progress
        </a>
        .
      </p>
    </div>
  );
}
