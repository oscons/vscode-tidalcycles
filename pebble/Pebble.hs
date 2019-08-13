{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE FlexibleContexts #-}
{-# LANGUAGE DataKinds #-}
{-# LANGUAGE KindSignatures #-}
{-# LANGUAGE GADTs #-}
{-# LANGUAGE FlexibleInstances #-}

module Pebble (
    patternToJsonI
    , patternToJson
    , answerMe
    , answerMeF
) where 

import qualified Data.Map as Map;
import Data.Ratio (denominator, numerator);

import Data.Aeson;
import qualified Data.ByteString.Lazy.Char8 as Char8;

import qualified Sound.Tidal.Pattern as TP;
import qualified Sound.Tidal.Stream as TS;
import qualified Sound.Tidal.Config as TC;

import System.IO (Handle, hFlush, stdout, hPutStr, hPutChar, openBinaryFile
    , IOMode(..), hClose, hPutStrLn)

{-
Dummy type that is required to safely overload the existing ToJSON instance for
Rational for more concise conversion to JSON format.
-}
newtype PrettyJSONRational = MR { mrvalue :: Rational};
{-
This 
-}
instance ToJSON PrettyJSONRational
    where
        toJSON (MR v) = toJSONList [
            fromRational v
            , (fromIntegral $ numerator v)::Double
            , (fromIntegral $ denominator v)::Double
            ]

{-
Unwrap Sound.Tidal.Pattern.Value to the underlying values to use the existing
instances defined in Aeon.
-}
instance ToJSON TP.Value
    where
        toJSON (TP.VS v) = toJSON v
        toJSON (TP.VF v) = toJSON v
        toJSON (TP.VR v) = toJSON v
        toJSON (TP.VI v) = toJSON v
        toJSON (TP.VB v) = toJSON v

{-
Convert an Arc to JSON.
-}
instance ToJSON TP.Arc
        where
            toJSON a = object [
                "start" .= MR (TP.start a)
                , "stop" .= MR (TP.stop a)
                ]

{-
Convert ControlMap events to JSON.
-}
instance ToJSON (TP.Event TP.ControlMap)
    where
        toJSON e = object [
                "whole" .= TP.whole e
                , "part" .= TP.part e
                , "values" .= TP.value e
                ]
{-
Encode a number of cycles 'i' of a pattern 'p' to JSON representation.
-}
patternToJsonI :: Int -> TP.ControlPattern -> Char8.ByteString
patternToJsonI i p = encode $ toJSON (TP.queryArc p $ TP.Arc 0 $ fromIntegral i)

{-
Encode once cycle of a pattern 'p' to JSON representation.
-}
patternToJson :: TP.ControlPattern -> Char8.ByteString
patternToJson = patternToJsonI 1

theMagicString = "#:)))#"
endOfIdString = "#"

_answerMe :: Bool -> Handle -> String -> Char8.ByteString -> IO()
_answerMe f h i v
        | f = wflush h $ theMagicString ++ i ++ endOfIdString ++ gs v ++ theMagicString
        | otherwise = wflush h $ gs v
        where
            gs = Char8.unpack
            wflush h x = do
                hPutStrLn h x
                hFlush h

{-
Write a JSON string in Pebble "answer" format to 'stdout'.
-}
answerMe :: String -> Char8.ByteString -> IO()
answerMe = _answerMe True stdout

{-
Write a JSON string to a file.
-}
answerMeF :: String -> Char8.ByteString -> IO()
answerMeF f v = do
    h <- openBinaryFile f WriteMode
    _answerMe False h f v
    hClose h
