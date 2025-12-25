// Global component plugin placeholder (currently none registered)
const components = [];

export default {
  install(app) {
    components.forEach((component) => {
      app.component(component.name, component);
    });
  },
};
