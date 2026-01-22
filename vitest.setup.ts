import "@testing-library/jest-dom";

// Required for React 19 + @testing-library/react: act() and test utils use the same React instance.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
