# cra-to-parcel

This script migrates a non-ejected Create React App to Parcel.

```sh
npx cra-to-parcel
```

## What is migrated?

1. `react-scripts` is replaced with `parcel` in dependencies and package.json `scripts`
2. Jest config is ejected
3. `public/index.html` is updated to use Parcel syntax, and add explicit `<script src="../src/index.js">` tag
4. SVG react component imports are migrated to Parcel syntax
5. A `.postcssrc` is created if `@import-normalize` or Tailwind is detected
6. A `babel.config.json` is created if Babel macros are detected
