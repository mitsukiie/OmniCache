import type {ReactNode} from 'react';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Menos latência, menos chamadas repetidas',
    description: (
      <>
        Use cache local para responder em milissegundos após a primeira
        execução, reduzindo carga em APIs externas e no banco.
      </>
    ),
  },
  {
    title: 'API direta para JS e TS',
    description: (
      <>
        A documentação cobre os mesmos fluxos em JavaScript e TypeScript,
        com exemplos prontos para copiar e adaptar em produção.
      </>
    ),
  },
  {
    title: 'Observabilidade e controle de invalidação',
    description: (
      <>
        Monitore hits/misses, use hooks de evento e invalide por tag ou
        prefixo quando os dados mudarem.
      </>
    ),
  },
];

function Feature({title, description}: FeatureItem) {
  return (
    <div className={"col col--4 " + styles.featureCol}>
      <div className={styles.card}>
        <Heading as="h3" className={styles.cardTitle}>{title}</Heading>
        <p className={styles.cardDescription}>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
