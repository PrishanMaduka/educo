'use client';

import { useId, useState, type ReactNode } from 'react';

import { button, onlyParent } from './styles';

/**
 * The parent hero's actions (spec 19): the app is not in the stores yet, so **Get the Quad app**
 * says so in a status note instead of linking to a store; **Ask your school about Quad** goes to
 * the parent form. The badges sit under them with the note.
 */
export function GetApp({
  labels,
  badges,
}: {
  labels: { getApp: string; askSchool: string; note: string };
  badges: ReactNode;
}) {
  const [isOpen, setOpen] = useState(false);
  const noteId = useId();
  return (
    <>
      <div id="getapp" className={`flex flex-wrap gap-3 ${onlyParent}`}>
        <button
          type="button"
          aria-controls={noteId}
          aria-expanded={isOpen}
          onClick={() => {
            setOpen((open) => !open);
          }}
          className={button()}
        >
          {labels.getApp} <span aria-hidden="true">↓</span>
        </button>
        <a href="#demo" className={button({ variant: 'line' })}>
          {labels.askSchool}
        </a>
      </div>
      <div className={`flex flex-col gap-3 ${onlyParent}`}>
        {badges}
        <p
          id={noteId}
          role="status"
          className="m-0 max-w-[32em] text-[15px] text-site-on-navy-2 empty:hidden"
        >
          {isOpen ? labels.note : ''}
        </p>
      </div>
    </>
  );
}
