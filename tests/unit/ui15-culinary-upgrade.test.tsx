// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import {
  formatDifficultyLabel,
  matchStepIngredients,
  resolveStepTechnique,
  summarizeRecipeTechniques,
} from '../../src/web/lib/culinary-visuals';
import {
  CookingTechniqueVisual,
  KitchenLoopStrip,
  RecipeDishIllustration,
} from '../../src/web/components/cooking/CookingTechniqueVisual';

describe('UI15 culinary visuals & closed-loop experience', () => {
  it('classifies Vietnamese cooking steps into distinct culinary techniques with tool and heat guidance', () => {
    expect(resolveStepTechnique('Rửa sạch cà chua, thái múi cau và băm nhỏ tỏi.', 'Sơ chế', 0, 4).id).toBe('prep');
    expect(resolveStepTechnique('Ướp thịt với nước mắm, tiêu và hành tím trong 15 phút.', 'Ướp thịt', 1, 4).id).toBe('marinate');
    expect(resolveStepTechnique('Phi thơm tỏi với dầu ăn rồi cho thịt vào xào săn.', 'Xào thịt', 2, 4).id).toBe('saute');
    expect(resolveStepTechnique('Kho lửa nhỏ liu riu cho đến khi nước sốt sánh lại.', 'Kho thịt', 2, 4).id).toBe('simmer');
    expect(resolveStepTechnique('Đun sôi nước dùng, cho cá và rau vào nấu canh.', 'Nấu canh', 2, 4).id).toBe('boil');
    expect(resolveStepTechnique('Chiên vàng đều hai mặt trên chảo.', 'Chiên cá', 2, 4).id).toBe('fry');
    expect(resolveStepTechnique('Nêm nếm lại cho vừa ăn với chút nước mắm.', 'Nêm vị', 2, 4).id).toBe('season');
    expect(resolveStepTechnique('Múc ra tô, rắc hành ngò và thưởng thức nóng.', 'Trình bày', 3, 4).id).toBe('plate');
  });

  it('matches ingredients mentioned in a step instruction without diacritic fragility', () => {
    const ingredients = [
      { ingredientId: 'TOMATO', name: 'Cà chua', requiredQuantity: 2, unit: 'piece' as const },
      { ingredientId: 'GARLIC', name: 'Tỏi băm', requiredQuantity: 10, unit: 'g' as const },
      { ingredientId: 'PORK', name: 'Thịt ba chỉ', requiredQuantity: 300, unit: 'g' as const },
    ];
    const matched = matchStepIngredients('Phi thơm tỏi băm rồi cho cà chua vào xào chín mềm.', ingredients);
    expect(matched.map((item) => item.ingredientId)).toEqual(['TOMATO', 'GARLIC']);
  });

  it('summarizes unique techniques across a recipe and formats difficulty labels', () => {
    const techniques = summarizeRecipeTechniques({
      steps: [
        { stepNumber: 1, instruction: 'Thái lát thịt bò và rửa sạch rau.' },
        { stepNumber: 2, instruction: 'Ướp thịt bò với dầu hào 10 phút.' },
        { stepNumber: 3, instruction: 'Xào nhanh thịt bò trên lửa lớn.' },
        { stepNumber: 4, instruction: 'Cho ra đĩa và thưởng thức.' },
      ],
    });
    expect(techniques.map((t) => t.id)).toEqual(['prep', 'marinate', 'saute', 'plate']);
    expect(formatDifficultyLabel('easy').label).toBe('Dễ nấu');
    expect(formatDifficultyLabel('medium').label).toBe('Vừa phải');
    expect(formatDifficultyLabel('hard').label).toBe('Cầu kỳ');
  });

  it('renders pure SVG technique illustrations, dish illustrations and closed-loop navigation without raw img tags', () => {
    const tech = resolveStepTechnique('Phi thơm hành tỏi và xào đều.', 'Xào', 1, 3);
    const techHtml = renderToStaticMarkup(
      <CookingTechniqueVisual technique={tech} stepNumber={2} variant="stage" />,
    );
    expect(techHtml).toContain('data-technique="saute"');
    expect(techHtml).toContain('Bước 02');
    expect(techHtml).toContain(tech.toolLabel);
    expect(techHtml).toContain('<svg');
    expect(techHtml).not.toContain('<img');

    const dishHtml = renderToStaticMarkup(<RecipeDishIllustration title="Canh chua" />);
    expect(dishHtml).toContain('recipe-dish-illustration');
    expect(dishHtml).toContain('<svg');
    expect(dishHtml).not.toContain('<img');

    const loopHtml = renderToStaticMarkup(
      <StaticRouter location="/recipes">
        <KitchenLoopStrip activeStage="recipes" summaryText="Đủ nguyên liệu" />
      </StaticRouter>,
    );
    expect(loopHtml).toContain('Chu trình bếp khép kín Takolio');
    expect(loopHtml).toContain('1. Tủ lạnh');
    expect(loopHtml).toContain('2. Chọn món');
    expect(loopHtml).toContain('3. Thực đơn');
    expect(loopHtml).toContain('4. Đi chợ');
    expect(loopHtml).toContain('aria-current="step"');
  });
});
