import type { GetServerSideProps, NextPage } from "next"
import ProfileImage from "src/components/ProfileImage"

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.ENABLE_QA_ROUTES === "true" ? { props: {} } : { notFound: true }

const ProfileImageHydrationQaPage: NextPage = () => (
  <main>
    <ProfileImage
      alt="QA administrator profile"
      data-testid="qa-profile-image"
      fallbackSrc="/images/default-profile.svg"
      priority
      src="/images/default-profile.svg?qa=already-complete-broken"
    />
  </main>
)

export default ProfileImageHydrationQaPage
