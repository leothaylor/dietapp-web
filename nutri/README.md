# Nutri — Diário nutricional pessoal (MVP)

Aplicativo PWA independente, localizado em `dietapp-web/nutri/`. **Não altera o DietApp antigo na raiz do repositório.**

## Funcionalidades implementadas

- Diário por data e refeição; lançamento em gramas; macros e calorias.
- Alimentos pessoais, edição, exclusão e busca local.
- Catálogo TACO (597 alimentos) sob demanda e importação por alimento via API estática.
- Consulta EAN/UPC por Open Food Facts; scanner câmera com BarcodeDetector ou fallback ZXing (conexão necessária para carregar a biblioteca fallback).
- Receitas com ingredientes em gramas e rendimento final, criando tabela por 100 g.
- Relatório de 7 dias, micronutrientes com indicação de dados incompletos.
- Metas editáveis, IndexedDB local e backup/restauração JSON completo e versionado.
- PWA instalável e shell disponível offline após primeiro carregamento.

## Publicação e execução

GitHub Pages: se o repositório estiver publicado a partir de `main` e `/ (root)`, abrir:
`https://leothaylor.github.io/dietapp-web/nutri/`

Caso Pages não esteja ativado, em **Settings → Pages → Build and deployment → Deploy from a branch → main / (root)**.

Localmente, sirva a raiz do repositório por HTTP (não abra com file://, pois PWA e IndexedDB exigem contexto apropriado):

```bash
python -m http.server 8000
# abrir http://localhost:8000/nutri/
```

## Dados e privacidade

A interface e o código ficam no GitHub; **as entradas pessoais não são enviadas** ao repositório. Cada navegador/dispositivo mantém um banco IndexedDB próprio. Limpar dados do site pode eliminar registros. Exporte o JSON periodicamente para armazenamento externo. Restaurar substitui todas as coleções locais.

As entradas do diário guardam cópias dos nutrientes calculados na ocasião, de modo que a edição posterior de um alimento não altera lançamentos antigos. Receitas também guardam snapshots de seus ingredientes.

## Licenças e referências

- TACO (NEPA/UNICAMP), API estática de brolesi/taco: https://github.com/brolesi/taco
- Open Food Facts (dados colaborativos ODbL): https://world.openfoodfacts.org/
- ZXing Browser para fallback de scanner (MIT): https://github.com/zxing-js/browser

Não há cópia de código do OpenNutriTracker, NutriTrace ou wger.

## Limitações da V1

- Câmera e Open Food Facts requerem internet na primeira utilização; offline não consulta produtos novos.
- Informações nutricionais incompletas são mostradas como ausentes, nunca assumidas como zero.
- TACO é importada sob demanda; o catálogo completo (índice) é armazenado localmente após a primeira consulta.
- Quantidades são expressas em gramas, incluindo bebidas; não há medidas caseiras automáticas nem leitura OCR de rótulo.
- Não existe sincronização entre dispositivos. Use exportação/importação JSON.
- Não existe IA no app nem reconhecimento de comida por fotografia.
- As estimativas das receitas não modelam perdas específicas de nutrientes por cozimento.
- Uso do scanner ZXing depende de disponibilidade de CDN no navegador; o formulário manual serve de fallback.
- Os micros agregados podem ser parciais se produtos de rótulo não fornecerem os campos.

## Teste de aceite

1. Abrir em HTTPS, cadastrar alimento com macros e um micronutriente conhecido.
2. Registrar 120 g no almoço e conferir escala `x 1.2`.
3. Editar alimento original; confirmar que o lançamento histórico não mudou.
4. Criar receita de dois ingredientes; informar rendimento final, registrar porção e conferir os cálculos.
5. Exportar JSON; restaurar em navegador de teste, conferir totais.
6. Importar arroz cozido pela TACO e conferir identificação de preparo.
7. Testar câmera no Safari do iPhone; usar EAN manual se necessário.
8. Desligar a internet após o primeiro carregamento; confirmar que o app abre e os dados locais permanecem acessíveis.

**Status:** código inicial publicado; testes reais no iPhone e ativação do Pages precisam ser conferidos no dispositivo/ambiente publicado.
