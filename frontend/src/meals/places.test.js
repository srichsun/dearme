import { describe, expect, it } from "vitest";
import { toPlaceFields } from "./places";

describe("toPlaceFields", () => {
  it("maps Google's shape onto the seven columns", () => {
    expect(
      toPlaceFields({
        id: "ChIJx",
        displayName: { text: "石二鍋 後山埤店", languageCode: "zh-TW" },
        formattedAddress: "110台北市信義區忠孝東路五段",
        nationalPhoneNumber: "02 2345 6789",
        location: { latitude: 25.0447, longitude: 121.5824 },
        googleMapsUri: "https://maps.google.com/?cid=1",
      }),
    ).toEqual({
      place_id: "ChIJx",
      place_name: "石二鍋 後山埤店",
      address: "110台北市信義區忠孝東路五段",
      phone: "02 2345 6789",
      lat: 25.0447,
      lng: 121.5824,
      maps_url: "https://maps.google.com/?cid=1",
    });
  });

  it("leaves out what Google did not have, as null", () => {
    expect(toPlaceFields({ id: "x", displayName: { text: "無電話" } })).toMatchObject({
      phone: null, lat: null, lng: null, address: null, maps_url: null,
    });
    expect(toPlaceFields(null)).toBeNull();
  });
});
