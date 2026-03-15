#!/usr/bin/env python3
"""Convert PDF pages to Markdown using FireRed-OCR (AI vision model)."""

import sys
import os
import tempfile
import torch


PROMPT = """You are an AI assistant specialized in converting PDF images to Markdown format. Please follow these instructions for the conversion:

            1. Text Processing:
            - Accurately recognize all text content in the PDF image without guessing or inferring.
            - Convert the recognized text into Markdown format.
            - Maintain the original document structure, including headings, paragraphs, lists, etc.

            2. Mathematical Formula Processing:
            - Convert all mathematical formulas to LaTeX format.
            - Enclose inline formulas with \\( \\). For example: This is an inline formula \\( E = mc^2 \\)
            - Enclose block formulas with \\[ \\]. For example: \\[ \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} \\]

            3. Table Processing:
            - Convert tables to HTML format.
            - Wrap the entire table with <table> and </table>.

            4. Figure Handling:
            - Ignore figures content in the PDF image. Do not attempt to describe or convert images.

            5. Output Format:
            - Ensure the output Markdown document has a clear structure with appropriate line breaks between elements.
            - For complex layouts, try to maintain the original document's structure and format as closely as possible.

            Please strictly follow these guidelines to ensure accuracy and consistency in the conversion. Your task is to accurately convert the content of the PDF image into Markdown format without adding any extra explanations or comments.
            """


def main():
    if len(sys.argv) < 2:
        print("Usage: firered-ocr.py <pdf_path>", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    # Convert PDF pages to images using PyMuPDF
    import fitz

    doc = fitz.open(pdf_path)
    if doc.page_count == 0:
        print("No pages found in PDF", file=sys.stderr)
        sys.exit(1)

    # Force CPU — MPS runs out of memory on 24GB Mac mini for this model
    device = "cpu"
    dtype = torch.float32

    print(f"Using device: {device}", file=sys.stderr)
    print(f"Loading model...", file=sys.stderr)

    from transformers import Qwen3VLForConditionalGeneration, AutoProcessor

    model_name = "FireRedTeam/FireRed-OCR"
    processor = AutoProcessor.from_pretrained(model_name)
    model = Qwen3VLForConditionalGeneration.from_pretrained(
        model_name, torch_dtype=dtype
    ).to(device)

    print(f"Processing {doc.page_count} pages...", file=sys.stderr)

    results = []
    with tempfile.TemporaryDirectory() as tmpdir:
        for i in range(doc.page_count):
            page = doc[i]
            pix = page.get_pixmap(dpi=200)
            img_path = os.path.join(tmpdir, f"page_{i:04d}.png")
            pix.save(img_path)

            print(f"OCR page {i + 1}/{doc.page_count}...", file=sys.stderr)

            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "image": img_path},
                        {"type": "text", "text": PROMPT},
                    ],
                },
            ]

            inputs = processor.apply_chat_template(
                messages,
                tokenize=True,
                add_generation_prompt=True,
                return_dict=True,
                return_tensors="pt",
            ).to(model.device)

            with torch.no_grad():
                outputs = model.generate(**inputs, max_new_tokens=4096)

            generated_ids = [
                out_ids[len(in_ids) :]
                for in_ids, out_ids in zip(inputs.input_ids, outputs)
            ]
            text = processor.batch_decode(
                generated_ids,
                skip_special_tokens=True,
                clean_up_tokenization_spaces=False,
            )[0]

            results.append(text)

    doc.close()

    # Output combined markdown to stdout
    print("\n\n---\n\n".join(results))


if __name__ == "__main__":
    main()
