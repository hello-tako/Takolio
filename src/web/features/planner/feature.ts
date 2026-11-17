export const isMealPlannerEnabled = () => {
  const flag = import.meta.env.VITE_MEAL_PLANNER_ENABLED;
  if (import.meta.env.MODE === 'test') {
    return flag === 'true';
  }
  return flag !== 'false';
};
