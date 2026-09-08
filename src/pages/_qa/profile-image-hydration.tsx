import type { GetServerSideProps, NextPage } from "next"
import { useState } from "react"
import ProfileImage from "src/components/ProfileImage"

type ProfileImageHydrationQaPageProps = {
  initialSource: string
}

export const getServerSideProps: GetServerSideProps<ProfileImageHydrationQaPageProps> = async ({ query }) => {
  if (process.env.ENABLE_QA_ROUTES !== "true") return { notFound: true }

  const state = typeof query.state === "string" ? query.state : "valid"
  return {
    props: {
      initialSource: `/images/profile-image-state.png?state=${state}`,
    },
  }
}

const ProfileImageHydrationQaPage: NextPage<ProfileImageHydrationQaPageProps> = ({ initialSource }) => {
  const [source, setSource] = useState(initialSource)

  return (
    <main>
      <ProfileImage alt="QA administrator profile" data-testid="qa-profile-image" priority src={source} />
      <div
        data-testid="qa-profile-image-small-frame"
        style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", position: "relative" }}
      >
        <ProfileImage
          alt="QA small administrator profile"
          data-testid="qa-profile-image-small"
          fillContainer
          priority
          src={source}
        />
      </div>
      <button type="button" onClick={() => setSource("")}>QA 이미지 비우기</button>
      <button type="button" onClick={() => setSource("/images/profile-image-state.png?state=broken")}>QA 이미지 실패</button>
      <button type="button" onClick={() => setSource("/images/profile-image-state.png?state=recovered")}>QA 이미지 복구</button>
    </main>
  )
}

export default ProfileImageHydrationQaPage
