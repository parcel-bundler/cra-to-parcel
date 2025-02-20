# cra-to-parcel

This script migrates a non-ejected Create React App to Parcel.

```sh
npx cra-to-parcel
```

## What is migrated?

For full details and manual instructions, see [the Parcel website](https://parceljs.org/migration/cra/). In summary:

1. `react-scripts` is replaced with `parcel` in dependencies and package.json `scripts`
2. Jest config is ejected, and the necessary dependencies are installed
3. `public/index.html` is updated to use Parcel syntax, and add explicit `<script src="../src/index.js">` tag
4. SVG react component imports are migrated to Parcel syntax
5. A `.postcssrc` is created if `@import-normalize` or Tailwind is detected
6. A `babel.config.json` is created if Babel macros (e.g. GraphQL imports) are detected
7. A `"lint"` script is added to run eslint
8. `.gitignore` is updated to add the Parcel cache and dist directories
