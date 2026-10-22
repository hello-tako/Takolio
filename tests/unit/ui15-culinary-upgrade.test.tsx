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
    expect(resolveStepTechnique('Cho cá vào xửng hấp cách thủy 15 phút.', 'Hấp cá', 2, 4).id).toBe('steam');
    expect(resolveStepTechnique('Chiên vàng đều hai mặt trên chảo.', 'Chiên cá', 2, 4).id).toBe('fry');
    expect(resolveStepTechnique('Nêm nếm lại cho vừa ăn với chút nước mắm.', 'Nêm vị', 2, 4).id).toBe('season');
    expect(resolveStepTechnique('Múc ra tô, rắc hành ngò và thưởng thức nóng.', 'Trình bày', 3, 4).id).toBe('plate');
  });

  it('handles multi-action sentences, modifier clauses, and neutral fallback without false-positive guessing', () => {
    expect(resolveStepTechnique('Cho thịt đã ướp vào xào săn trên lửa lớn.', undefined, 1, 4).id).toBe('saute');
    expect(resolveStepTechnique('Xào thơm tỏi trên lửa nhỏ để không bị cháy.', undefined, 1, 4).id).toBe('saute');
    expect(resolveStepTechnique('Đảo đều trên lửa vừa khoảng 3 phút.', undefined, 1, 4).id).toBe('saute');
    expect(resolveStepTechnique('Hấp cách thủy khoảng 20 phút cho chín đều.', undefined, 2, 4).id).toBe('steam');
    expect(resolveStepTechnique('Kiểm tra lại trước khi chuyển công đoạn tiếp theo.', undefined, 0, 4).id).toBe('general');
    expect(resolveStepTechnique('Kiểm tra lại trước khi chuyển công đoạn tiếp theo.', undefined, 2, 4).id).toBe('general');
    expect(resolveStepTechnique('Kiểm tra lại trước khi chuyển công đoạn tiếp theo.', undefined, 3, 4).id).toBe('general');
  });

  it('matches ingredients with word boundaries, controlled stems, diacritic tolerance, and zero silent truncation', () => {
    const ingredients = [
      { ingredientId: 'TOMATO', name: 'Cà chua', requiredQuantity: 2, unit: 'piece' as const },
      { ingredientId: 'GARLIC', name: 'Tỏi băm', requiredQuantity: 10, unit: 'g' as const },
      { ingredientId: 'PORK', name: 'Thịt ba chỉ', requiredQuantity: 300, unit: 'g' as const },
      { ingredientId: 'SCALLION', name: 'Hành lá', requiredQuantity: 20, unit: 'g' as const },
      { ingredientId: 'ONION', name: 'Hành', requiredQuantity: 50, unit: 'g' as const },
      { ingredientId: 'FISH', name: 'Cá lóc', requiredQuantity: 500, unit: 'g' as const },
      { ingredientId: 'GINGER', name: 'Gừng thái sợi', requiredQuantity: 15, unit: 'g' as const },
      { ingredientId: 'PEPPER', name: 'Tiêu xay', requiredQuantity: 5, unit: 'g' as const },
    ];

    expect(
      matchStepIngredients('Phi thơm tỏi rồi cho cà chua vào xào chín mềm.', ingredients).map(
        (item) => item.ingredientId,
      ),
    ).toEqual(['TOMATO', 'GARLIC']);

    expect(
      matchStepIngredients('Phi thom toi roi cho ca chua vao xao chin mem.', ingredients).map(
        (item) => item.ingredientId,
      ),
    ).toEqual(['TOMATO', 'GARLIC']);

    expect(
      matchStepIngredients('Đảo nhanh tay trên chảo nóng.', ingredients).map((item) => item.ingredientId),
    ).toEqual([]);

    expect(
      matchStepIngredients('Cho cá vào nồi nước đang sôi.', ingredients).map((item) => item.ingredientId),
    ).toEqual(['FISH']);

    const manyMatch = matchStepIngredients(
      'Cho cà chua, tỏi, thịt ba chỉ, hành lá, cá lóc, gừng và tiêu vào nồi.',
      ingredients,
    );
    expect(manyMatch.map((item) => item.ingredientId)).toEqual([
      'TOMATO',
      'GARLIC',
      'PORK',
      'SCALLION',
      'FISH',
      'GINGER',
      'PEPPER',
    ]);
  });

  it('summarizes unique recognized techniques across a recipe and formats difficulty labels', () => {
    const techniques = summarizeRecipeTechniques({
      steps: [
        { stepNumber: 1, instruction: 'Thái lát thịt bò và rửa sạch rau.' },
        { stepNumber: 2, instruction: 'Ướp thịt bò với dầu hào 10 phút.' },
        { stepNumber: 3, instruction: 'Kiểm tra lại dụng cụ trước khi bật bếp.' },
        { stepNumber: 4, instruction: 'Xào nhanh thịt bò trên lửa lớn.' },
        { stepNumber: 5, instruction: 'Cho ra đĩa và thưởng thức.' },
      ],
    });
    expect(techniques.map((t) => t.id)).toEqual(['prep', 'marinate', 'saute', 'plate']);
    expect(formatDifficultyLabel('easy').label).toBe('Dễ nấu');
    expect(formatDifficultyLabel('medium').label).toBe('Vừa phải');
    expect(formatDifficultyLabel('hard').label).toBe('Cầu kỳ');
    expect(formatDifficultyLabel(undefined).label).toBe('Chuẩn bếp nhà');
  });

  it('renders SVG technique illustrations with official TakosanIcon badges, dish illustrations and closed-loop navigation', () => {
    for (const sample of [
      resolveStepTechnique('Phi thơm hành tỏi và xào đều.', 'Xào', 1, 3),
      resolveStepTechnique('Hấp cách thủy 15 phút.', 'Hấp', 1, 3),
      resolveStepTechnique('Chờ 5 phút trước khi tiếp tục.', undefined, 1, 3),
    ]) {
      const techHtml = renderToStaticMarkup(
        <CookingTechniqueVisual technique={sample} stepNumber={2} variant="stage" />,
      );
      expect(techHtml).toContain(`data-technique="${sample.id}"`);
      expect(techHtml).toContain('Bước 02');
      expect(techHtml).toContain(sample.toolLabel);
      expect(techHtml).toContain('<svg');
      expect(techHtml).toContain('data-takosan-icon="chef"');
      expect(techHtml).toContain('data-takosan-icon="ingredient"');
    }

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
