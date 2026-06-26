import { Layout } from 'antd';

const { Footer } = Layout;

export function AppFooter() {
  return (
    <Footer style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.65)', background: 'transparent' }}>
      Demo Vite, TypeScript, Ant Design, Bootstrap, Node.js, MongoDB
    </Footer>
  );
}
