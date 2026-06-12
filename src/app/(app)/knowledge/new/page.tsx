import Link from "next/link";
import { AddDocumentForm } from "./add-document-form";

export default function NewDocumentPage() {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <Link
          href="/knowledge"
          className="text-[13px] font-semibold text-brand hover:underline"
        >
          ← Knowledge Hub
        </Link>
        <h1 className="font-serif text-[28px] font-semibold">Add document</h1>
        <p className="text-[14.5px] text-ink-muted">
          Upload a file or paste approved text. Every paragraph becomes a
          citable source for generated content.
        </p>
      </div>
      <AddDocumentForm />
    </div>
  );
}
