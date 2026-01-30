import React from 'react';

interface SectionProps {
  children: React.ReactNode;
}

export const Section = ({ children }: SectionProps) => (
  <div className="playground-section">{children}</div>
);

interface SectionTitleProps {
  children: React.ReactNode;
  id: string;
}

export const SectionTitle = ({ children, id }: SectionTitleProps) => (
  <div className="section-title" id={id}>
    <h3>{children}</h3>
  </div>
);

interface SectionContentProps {
  children: React.ReactNode;
}

export const SectionContent = ({ children }: SectionContentProps) => (
  <div className="section-content">{children}</div>
);

interface DemoItem {
  label: string;
  component: React.ReactElement;
}

interface DemoListProps {
  items: DemoItem[];
}

export const DemoList = ({ items }: DemoListProps) => (
  <>
    {items.map(({ label, component }) => (
      <div key={label} className="demo-item">
        <div className="demo-label">{label}</div>
        {component}
      </div>
    ))}
  </>
);
