# Nutri 2.0 — diário nutricional e corporal pessoal

PWA local-first, **sem mensalidade, login obrigatório ou backend**. Hospedado no GitHub Pages no endereço principal:
https://leothaylor.github.io/dietapp-web/

**Atenção:** todos os dados pessoais permanecem no IndexedDB do navegador de cada dispositivo. O GitHub hospeda apenas o código. Faça backups JSON regulares; trocar de navegador ou apagar dados do site pode apagar seu histórico.

## Módulos e capacidades

| Módulo | Recursos |
| --- | --- |
| Diário | Refeições por data, macros, calorias, refeições personalizadas, copiar dia/refeição, favoritos completos |
| Alimentos | Cadastro manual, macronutrientes e micros, porções em gramas/medidas caseiras, TACO, códigos EAN/UPC via Open Food Facts, USDA opcional, importação JSON da biblioteca |
| Receitas | Ingredientes e pesos, rendimento final, número de porções, cálculo por 100 g, duplicação e reaproveitamento |
| Evolução corporal | Peso, meta ou faixa de peso, altura, sexo para fórmula, cintura, pescoço, quadril, braço, antebraço, peitoral, abdômen, coxa e panturrilha, BF US Navy ou BF informado, massa gorda e massa livre de gordura estimadas, média móvel de peso 7 dias, gráficos por período |
| Hidratação | Atalhos +150/+200/+300/+500/+1000 ml, quantidade livre, meta diária, calendário, registros e gráfico de 30 dias |
| Análises | Calorias e micros, médias de macros, cobertura dos dados, aderência às metas, tendências, comparação 7/30 dias, CSV de nutrição, antropometria e água |
| Medalhas | 130 medalhas automáticas em sete categorias; coloridas após desbloqueadas e cinza quando bloqueadas, progresso, data de conquista e notificação visual |
| Ajustes | Metas alimentares, altura, sexo do cálculo, peso-alvo/faixa e água; backup integral JSON com importação compatível com backups antigos |

## Privacidade e dados

- Banco original: **nutri-diario-v1**. Preservado durante a atualização de estrutura v1 → v2, sem apagar os registros anteriores.
- Collections legadas: \`foods\`, \`recipes\`, \`entries\`, \`settings\`, \`cache\`.
- Novas collections v2: \`body\`, \`water\`, \`favorites\`, \`awards\`.
- Backup JSON v2 guarda todos os módulos, metas, histórico de conquistas e configurações. Backups v1 continuam restauráveis.
- Importação **substitui** os dados somente depois de validação e confirmação explícita.
- O diário guarda os valores nutricionais calculados no momento do registro (snapshot), preservando histórico após edição de um alimento ou receita.
- Cópia e favorito reutilizam os registros como snapshots, sem recalcular retroativamente os dados.
- Os campos de micronutrientes desconhecidos são \`null\`, jamais confundidos com zero.

## Critérios científicos

O BF pela equação de circunferências US Navy depende das medidas apropriadas, da altura e do sexo selecionado para a fórmula. Não equivale a avaliação clínica ou DEXA. Massa livre de gordura inclui água, ossos, órgãos e outros tecidos; **não é medição de músculo**.

As medalhas de composição corporal baseadas em estimativas exigem pelo menos quatro avaliações em dias distintos, duas no período inicial e duas no final, separadas por no mínimo 14 dias e com método comparável. A sensibilidade não é suficiente para comprovar uma variação real de 500 g de gordura ou músculo: a medalha corresponde apenas a um **marco da tendência estimada**. O aplicativo não recomenda restrição extrema, emagrecimento acelerado nem volumes excessivos de água.

Desafios de 3 L funcionam como marcos automáticos do registro, **não como recomendação universal de ingestão hídrica**.

## Leitura de código de barras, TACO e USDA

- **TACO:** catálogo brasileiro público por solicitação, via API estática de [brolesi/taco](https://github.com/brolesi/taco).
- **Open Food Facts:** consulta EAN/UPC pelo serviço colaborativo, sujeito a limites, disponibilidade e qualidade dos rótulos. O navegador pode utilizar \`BarcodeDetector\` ou ZXing como fallback; digitação manual continua disponível.
- **USDA FoodData Central:** busca gratuita pelo botão "Pesquisar USDA", dados *Foundation* ou *SR Legacy*; integra micronutrientes nos nomes internos. Começa com a \`DEMO_KEY\` pública, que possui limites compartilhados (30/h e 50/dia por IP) e pode ficar indisponível. Não incluímos chave pessoal no código. [Documentação oficial](https://fdc.nal.usda.gov/api-guide/).
- Fontes externas são identificadas e nunca substituem o julgamento sobre a qualidade de um rótulo ou preparo.

## Importação JSON produzida pelo GPT

No módulo **Alimentos → Importar JSON GPT**, aceite um arquivo com este formato:

\`\`\`json
{
  "schema": "nutri-library",
  "version": 1,
  "foods": [
    {
      "name": "Pão integral caseiro",
      "brand": "",
      "barcode": "",
      "nutrients": {
        "kcal": 240,
        "protein": 9,
        "carbs": 44,
        "fat": 3,
        "fiber": 7,
        "sodium": 320,
        "calcium": null,
        "iron": null
      },
      "portions": [
        {"name": "1 fatia", "grams": 30}
      ]
    }
  ],
  "recipes": [
    {
      "name": "Sanduíche simples",
      "yieldGrams": 60,
      "servings": 1,
      "ingredients": [
        {"foodName": "Pão integral caseiro", "grams": 60}
      ]
    }
  ]
}
\`\`\`

- Os valores nutricionais devem ser informados **por 100 gramas**, com unidades: kcal, proteína/carboidratos/gorduras/fibras em g, minerais em mg e vitamina A (RAE) em µg.
- Campos ausentes ficam \`null\`; não invente valores ou fontes.
- Os ingredientes de uma receita devem coincidir com nomes de alimentos importados no mesmo arquivo ou já salvos na biblioteca.
- Cada arquivo é validado antes de gravar os alimentos. Importações não apagam a biblioteca existente.
- Para receitas, dados após cocção não corrigem perdas específicas de vitaminas ou minerais.

## Testar localmente e no GitHub

Código estático, sem build ou conta. Para servir localmente:

\`\`\`bash
python -m http.server 8000
\`\`\`

Abrir http://localhost:8000/ (PWA requer HTTPS ou localhost para funcionalidades seguras).

Para testes de regressão, usar Node.js 20+:

\`\`\`bash
npm test
npm run check
\`\`\`

### Checklist manual de homologação

- [ ] A página principal abre como Nutri (sem login antigo).
- [ ] Alimentos e refeições anteriores permanecem após atualização.
- [ ] Criar, renomear e remover espaço de refeição sem alterar histórico.
- [ ] Cadastrar alimento com 100 g de referência e porção de 30 g; lançar 2 porções e conferir nutrientes.
- [ ] Criar receita de dois ingredientes, com rendimento de 350 g e 5 porções; registrar porção de 70 g.
- [ ] Copiar refeição do dia anterior e salvar/usar favorito.
- [ ] Registrar pesagem, cintura e pescoço; verificar cálculo BF com altura/sexo definidos e série temporal.
- [ ] Editar metas, registrar água em doses e consultar data anterior.
- [ ] Lançar 3 L em sete dias consecutivos num ambiente de teste e verificar medalha; verificar bloqueio de 14 dias.
- [ ] Exportar CSV de alimentação, corpo e água.
- [ ] Exportar backup v2 e restaurar em navegador limpo; conferir registros, receitas, pesos, água, medalhas e metas.
- [ ] Restaurar backup v1 em navegador de teste, confirmar preservação dos campos antigos.
- [ ] Testar TACO, USDA, EAN e scanner real no Safari iPhone.
- [ ] Abrir o aplicativo offline após primeiro carregamento.
- [ ] Testar responsividade das oito áreas no celular e a notificação de medalhas.

## Desenvolvimento e licenças

Sem dependências obrigatórias de runtime, com scripts ES modules e CSS responsivo. Medals e Navy ficam no módulo puro \`achievements.js\`. Recursos novos estão em \`extras.js\` e \`extras.css\`, com módulo USDA separado, enquanto o diário original permanece em \`app.js\`.

**Limitações:** não há sincronização automática entre dispositivos, leitura de alimento por fotografia, chat IA embutido, metas distintas por treino ou integração com AtlasTreino. Nenhum desses recursos foi solicitado para a versão atual.
